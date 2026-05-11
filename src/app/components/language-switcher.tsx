import { useLanguage } from "../context/language-context";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => setLanguage("en")}
        className={`transition-opacity ${
          language === "en" ? "opacity-100" : "opacity-50 hover:opacity-75"
        }`}
        title="English"
      >
        <img src="https://flagcdn.com/gb.svg" alt="EN" className="h-6 w-8 rounded-sm object-cover" loading="lazy" decoding="async" />
      </button>
      <button
        onClick={() => setLanguage("ru")}
        className={`transition-opacity ${
          language === "ru" ? "opacity-100" : "opacity-50 hover:opacity-75"
        }`}
        title="Русский"
      >
        <img src="https://flagcdn.com/ru.svg" alt="RU" className="h-6 w-8 rounded-sm object-cover" loading="lazy" decoding="async" />
      </button>
    </div>
  );
}
