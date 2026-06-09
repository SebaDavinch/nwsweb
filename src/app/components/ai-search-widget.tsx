import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Intent-based response engine — no API needed
function getResponse(text: string, ru: boolean): string {
  const lower = text.toLowerCase().trim();

  if (/вступ|присоедин|регистр|как стать|начать летать|как летать|как зарегистр/.test(lower) || /join|register|sign.?up|how to start|how do i/.test(lower)) {
    return ru
      ? "Чтобы вступить в Nordwind Virtual:\n\n1. Нажми «Вступить» в меню\n2. Зарегистрируйся на платформе vAMSYS\n3. Тебе назначат каллсайн\n4. Доступен личный кабинет пилота\n\nРегистрация занимает 2–3 минуты."
      : "To join Nordwind Virtual:\n\n1. Click «Join» in the menu\n2. Register on the vAMSYS platform\n3. You'll receive a callsign\n4. Pilot dashboard will be available\n\nRegistration takes 2–3 minutes.";
  }

  if (/флот|самолёт|воздушн|какие.*самолёт|fleet|aircraft|plane|airbus|boeing/.test(lower)) {
    return ru
      ? "Nordwind Virtual эксплуатирует воздушные суда трёх авиакомпаний-партнёров: Boeing 737, Airbus A320/A321 и другие типы. Полный актуальный парк — на странице «Флот»."
      : "Nordwind Virtual operates aircraft from three partner airlines: Boeing 737, Airbus A320/A321, and other types. Full up-to-date fleet is on the Fleet page.";
  }

  if (/маршрут|рейс|откуда|куда|аэропорт|route|flight|airport|destination/.test(lower)) {
    return ru
      ? "Маршрутная сеть охватывает десятки направлений по России и СНГ. Найти конкретный рейс можно через:\n\n• Страницу «Маршруты»\n• Поиск (Ctrl+K) — введи код аэропорта или «из Москвы»"
      : "Our route network covers dozens of destinations across Russia and CIS. Find a specific flight via:\n\n• The Routes page\n• Search (Ctrl+K) — type an airport code or «from Moscow»";
  }

  if (/контакт|связат|написать|поддержк|support|contact|help|ticket/.test(lower)) {
    return ru
      ? "Способы связи:\n\n• Тикет — раздел «Связаться» (самый надёжный)\n• Discord — сервер сообщества\n• VK — публичное сообщество\n\nДля официальных вопросов рекомендуем тикет."
      : "Ways to contact us:\n\n• Ticket — Contact section (most reliable)\n• Discord — community server\n• VK — public community\n\nFor official matters we recommend a ticket.";
  }

  if (/vatsim|ватсим/.test(lower)) {
    return ru
      ? "Nordwind Virtual поддерживает полёты в сети VATSIM. События и онлайн-дни публикуются в разделе «Активности» и в Discord."
      : "Nordwind Virtual supports flying on the VATSIM network. Events and online days are posted in Activities and Discord.";
  }

  if (/событ|мероприят|ивент|event|activit/.test(lower)) {
    return ru
      ? "Все мероприятия — в разделе «Активности». Также следи за анонсами в Discord и VK."
      : "All events are in the Activities section. Also follow announcements in Discord and VK.";
  }

  if (/документ|правил|устав|инструкц|document|rules|regulation/.test(lower)) {
    return ru
      ? "Все документы, правила и инструкции — в разделе «Документы». Там же лётные процедуры и регламенты."
      : "All documents, rules, and instructions are in the Documents section, including flight procedures and regulations.";
  }

  if (/команда|кто управляет|staff|team|who/.test(lower)) {
    return ru
      ? "Состав команды Nordwind Virtual можно посмотреть на странице «Команда». Там указаны все должности и контакты участников."
      : "The Nordwind Virtual team is listed on the Team page with all roles and contacts.";
  }

  if (/привет|здравствуй|hi|hello|hey/.test(lower)) {
    return ru
      ? "Привет! Чем могу помочь? Спроси про флот, маршруты, вступление или как с нами связаться."
      : "Hey! How can I help? Ask about our fleet, routes, how to join, or how to contact us.";
  }

  if (/спасибо|благодар|thanks|thank you/.test(lower)) {
    return ru ? "Пожалуйста! Если ещё будут вопросы — спрашивай." : "You're welcome! Feel free to ask if you have more questions.";
  }

  return ru
    ? "Я могу рассказать про:\n• Вступление в VA\n• Флот и маршруты\n• Связь с командой\n• Документы и правила\n• VATSIM и мероприятия\n\nТакже попробуй поиск (Ctrl+K) — он умеет объяснять своими словами."
    : "I can tell you about:\n• Joining the VA\n• Fleet and routes\n• Contacting the team\n• Documents and rules\n• VATSIM and events\n\nAlso try Search (Ctrl+K) — it can explain things in plain language.";
}

export function AiSearchWidget() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (ruStr: string, en: string) => (ru ? ruStr : en);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
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

  const send = () => {
    const text = input.trim();
    if (!text) return;

    const reply = getResponse(text, ru);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: reply },
    ]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#E31E24] text-white shadow-lg transition-all hover:bg-[#c41a20] hover:scale-105 focus:outline-none"
        aria-label={tr("Помощник", "Assistant")}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-[#E31E24] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Nordwind Помощник</div>
              <div className="text-[11px] text-white/70">{tr("Отвечу на вопросы о VA", "I'll answer your VA questions")}</div>
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
                      : "border border-gray-100 bg-gray-50 text-gray-800"
                  }`}
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

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
              />
              <Button
                type="button"
                size="icon"
                onClick={send}
                disabled={!input.trim()}
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
